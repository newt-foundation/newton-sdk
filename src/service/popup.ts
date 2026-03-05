import { renderPopupPrompt } from '@core/popup-prompt';
import { createRpcError, MagicRPCError, SDKError } from '@core/sdk-exceptions';
import { JsonRpcResponsePayload, NewtonIdpPayloadMethod, RPCErrorCode, SDKErrorCode } from '@core/types';
import { createPromiEvent } from '@core/utils/promise-tools';

const defaultEndpoint = 'https://persona-kyc-nextjs-bf5a.vercel.app';

enum NewtonIdpIncomingWindowMessage {
  NEWTON_VC_POPUP_READY = 'NEWTON_VC_POPUP_READY',
  NEWTON_VC_POPUP_RESPONSE = 'NEWTON_VC_POPUP_RESPONSE',
  NEWTON_VC_POPUP_EVENT = 'NEWTON_VC_POPUP_EVENT',
}

enum NewtonIdpOutgoingWindowMessage {
  NEWTON_VC_HANDLE_REQUEST = 'NEWTON_VC_HANDLE_REQUEST',
}

enum PopupIntermediaryEventName {
  POPUP_RHINESTONE_USER_ID_FOUND = 'POPUP_RHINESTONE_USER_ID_FOUND',
}

let popupReady = false;
let popup: Window | null = null;

function setPopup(_popup: Window | null) {
  popupReady = false;
  popup = _popup;
}

function isPopupReady(msgType: string) {
  return msgType === NewtonIdpIncomingWindowMessage.NEWTON_VC_POPUP_READY;
}

function isPopupResolve(msgType: string) {
  return msgType === NewtonIdpIncomingWindowMessage.NEWTON_VC_POPUP_RESPONSE;
}

const POPUP_ERROR_MESSAGES = {
  USER_CLOSED_POPUP: 'User closed the popup before a response was received',
  POP_WINDOW_ALREADY_EXISTS: 'Popup window already exists for this request',
  FAILED_TO_OPEN_POPUP: 'Failed to open popup window',
};

export function popupRequest<ResultType = any>(payload: any, endpointOverride?: string) {
  // Popup window constants
  const popupWidth = 448;
  const popupHeight = 620;
  const popupLeft = window.screenLeft + (window.outerWidth / 2 - popupWidth / 2);
  const popupTop = window.screenTop + window.outerHeight * 0.15;
  const popupPosition = `width=${popupWidth},height=${popupHeight},left=${popupLeft},top=${popupTop}`;
  const endpoint = endpointOverride || defaultEndpoint;
  const containerId = `newton-idp-popup-action-modal-container`;

  const isPopupOpen = () => popup && popup?.window !== null && !popup.closed;

  const openPopup = () => {
    setPopup(window.open(`${endpoint}/handle`, '_blank', popupPosition));
  };

  const promiEvent = createPromiEvent<ResultType>((resolve, reject) => {
    const focusPopup = () => {
      popup?.focus?.();
    };
    const refocusPromptContainerId = `newton-idp-popup-refocus-modal-container`;
    let unmountRefocusPrompt: () => void | undefined;
    const showRefocusPrompt = () => {
      const { unmount } = renderPopupPrompt({
        onContinue: () => {
          if (isPopupOpen()) {
            focusPopup();
          } else {
            openPopup();
          }
        },
        onDone: () => {},
        containerId: refocusPromptContainerId,
      });
      unmountRefocusPrompt = unmount;
    };
    const fulfillPromiEvent = (callback: () => void) => {
      unmountRefocusPrompt?.();
      callback?.();
    };

    // see if the popup or popup prompt modal already exists.
    let popupPromptModalExists = !!document.getElementById(containerId);
    if (isPopupOpen() && popupReady) {
      // Override current action or enqueue the new one
      focusPopup();
      popup?.postMessage({ msgType: NewtonIdpOutgoingWindowMessage.NEWTON_VC_HANDLE_REQUEST, payload }, '*');
    } else if (isPopupOpen() || popupPromptModalExists) {
      fulfillPromiEvent(() =>
        reject(new SDKError(SDKErrorCode.PopupAlreadyExists, POPUP_ERROR_MESSAGES.POP_WINDOW_ALREADY_EXISTS)),
      );
      return;
    } else {
      // try to open the pop up.
      openPopup();
      if (payload.method === NewtonIdpPayloadMethod.Connect) {
        showRefocusPrompt();
      }
    }

    // see if the popup was blocked, prompt user with action button
    if (!popup) {
      renderPopupPrompt({
        onDone: () => {
          popupPromptModalExists = true;
        },
        onContinue: () => {
          openPopup();
        },
        containerId,
        unmountOnContinue: true,
      });
    }

    let popupCheckInterval: NodeJS.Timeout | undefined;

    const clearPopupCheckInterval = () => {
      if (popupCheckInterval) clearInterval(popupCheckInterval);
    };

    const setPopupCheckInterval = () => {
      clearPopupCheckInterval();
      popupCheckInterval = setInterval(() => {
        popupPromptModalExists = !!document.getElementById(containerId);
        if (popupPromptModalExists) return;
        if (!isPopupOpen() || popup?.closed) {
          if (popupCheckInterval) clearInterval(popupCheckInterval);
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          window.removeEventListener('message', messageListener);
          setPopup(null);
          fulfillPromiEvent(() =>
            reject(createRpcError(RPCErrorCode.UserRejectedAction, POPUP_ERROR_MESSAGES.USER_CLOSED_POPUP)),
          );
          return;
        }
      }, 500);
    };

    setPopupCheckInterval();

    const messageListener = (event: MessageEvent) => {
      // Detatch the interval while processing a message so that when popup resolves and closes with
      // a specific message it is captured
      clearPopupCheckInterval();
      setTimeout(() => {
        setPopupCheckInterval();
      }, 1000);
      if (isPopupReady(event.data?.msgType)) {
        popupReady = true;
        popup?.postMessage({ msgType: NewtonIdpOutgoingWindowMessage.NEWTON_VC_HANDLE_REQUEST, payload }, '*');
        setPopupCheckInterval();
      } else if (isPopupResolve(event.data?.msgType)) {
        window.removeEventListener('message', messageListener);
        const response = event?.data?.response as JsonRpcResponsePayload;
        if (response?.error) {
          // If user logs out from the pop up, clear the local storage.
          if (response.error.code === RPCErrorCode.NewtonWalletSessionTerminated) {
            localStorage.removeItem('newtonWalletIdToken');
            localStorage.removeItem('newtonWalletPublicAddress');
          }
          if (!RPCErrorCode.PopupRequestOverriden) {
            setPopup(null);
          }
          fulfillPromiEvent(() => reject(new MagicRPCError(response?.error)));
        } else {
          fulfillPromiEvent(() => resolve(response?.result as ResultType));
        }
      } else if (event.data?.msgType === NewtonIdpIncomingWindowMessage.NEWTON_VC_POPUP_EVENT) {
        const intermediaryEventName = event.data?.response?.result?.event;
        if (!intermediaryEventName) return;
        const intermediaryEventParams = event.data?.response?.result?.params;
        if (
          intermediaryEventName === PopupIntermediaryEventName.POPUP_RHINESTONE_USER_ID_FOUND &&
          !!intermediaryEventParams[0]
        ) {
          const rhinestoneUserId = intermediaryEventParams[0];
          if (rhinestoneUserId) localStorage.setItem('newtonWalletRhinestoneUserId', rhinestoneUserId);
        }
        setPopupCheckInterval();
      }
    };

    window.addEventListener('message', messageListener);
  });
  return promiEvent;

  // TODO: implement batch request handling.
}
