import React from 'react';

export const GettingStartedIcon = () => {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="getting-started-icon"
    >
      <path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill="currentColor"
        className="star-path"
      />
      <style jsx>{`
        .getting-started-icon {
          display: inline-block;
        }
        
        .star-path {
          transform-origin: center;
          transition: transform 0.3s ease;
        }
        
        .getting-started-icon:hover .star-path {
          animation: pulse 0.6s ease-in-out;
        }
        
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
        }
      `}</style>
    </svg>
  );
};

export default GettingStartedIcon;
