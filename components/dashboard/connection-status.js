export default function ConnectionStatus({ isConnected }) {
  return (
    <div 
      className={`
        connection-status 
        ${isConnected ? 'connected' : 'disconnected'}
        transition-all duration-300
      `}
    >
      <span 
        className={`
          connection-indicator 
          ${isConnected ? 'connected' : 'disconnected'}
          ${isConnected ? 'animate-pulse' : ''}
        `}
      />
      <span>
        {isConnected ? 'متصل به تلگرام' : 'عدم اتصال به تلگرام'}
      </span>
    </div>
  );
}