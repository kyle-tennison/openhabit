// The app mark. Served from /logo.png so the same file is also the favicon.
export default function Logo({ size = 32 }) {
  return <img className="logo" src="/logo.png" width={size} height={size} alt="" />;
}
