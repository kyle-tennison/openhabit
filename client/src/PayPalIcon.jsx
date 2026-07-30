// PayPal's double-"P" mark, drawn inline so there is no external asset to load.
export default function PayPalIcon({ size = 14 }) {
  return (
    <svg
      className="paypal-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#002c8a"
        d="M6.9 21.6H3.4a.5.5 0 0 1-.49-.58L5.62 3.53a.85.85 0 0 1 .84-.72h6.3c3.36 0 5.5 1.63 5.06 4.75-.5 3.53-3.06 5.23-6.44 5.23H8.71a.85.85 0 0 0-.84.72l-.97 8.09z"
      />
      <path
        fill="#009be1"
        d="M8.86 22.9H5.4a.5.5 0 0 1-.5-.58l.36-2.28h2.98l.62-4.09a.85.85 0 0 1 .84-.72h1.86c3.38 0 5.94-1.7 6.44-5.22a4.4 4.4 0 0 0 .04-1.02c1.66.72 2.44 2.2 2.11 4.52-.5 3.53-3.06 5.23-6.44 5.23h-1.67a.85.85 0 0 0-.84.72l-.5 3.44z"
      />
    </svg>
  );
}
