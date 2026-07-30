import PayPalIcon from "./PayPalIcon.jsx";

export const DONATE_URL =
  "https://www.paypal.com/donate/?business=54HEQEQEAT2M8&no_recurring=0&item_name=Help+pay+for+OpenHabit+hosting+to+keep+it+free+and+witout+ads.&currency_code=USD";

export default function Footer() {
  return (
    <footer className="app-foot">
      <span>OpenHabit is free and ad-free.</span>
      <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
        <PayPalIcon size={15} />
        Chip in for hosting
      </a>
    </footer>
  );
}
