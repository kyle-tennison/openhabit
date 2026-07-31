export const DONATE_URL =
  "https://www.paypal.com/donate/?business=54HEQEQEAT2M8&no_recurring=0&item_name=Help+pay+for+openhabit+hosting+to+keep+it+free+and+witout+ads.&currency_code=USD";

export const GITHUB_URL = "https://github.com/kyle-tennison/openhabit";

export const SUPPORT_EMAIL = "support@openhabit.co";

export default function Footer() {
  return (
    <footer className="app-foot">
      <span>openhabit is free and ad-free.</span>
      <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
        <i className="bi bi-paypal" aria-hidden="true"></i>
        Chip in for hosting
      </a>
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
        <i className="bi bi-github" aria-hidden="true"></i>
        Source on GitHub
      </a>
      <a href={`mailto:${SUPPORT_EMAIL}?subject=openhabit%20issue`}>Report an issue</a>
    </footer>
  );
}
