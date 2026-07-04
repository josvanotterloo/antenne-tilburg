// Reusable social links. Inline SVGs (no icon library); icons use `currentColor`
// so the #6B7DC9 signal hover recolours them. Standalone so the footer and home
// page can drop it in later.

function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M13.5 21v-8.2h2.75l.41-3.19H13.5V7.57c0-.92.26-1.55 1.58-1.55h1.69V3.17c-.29-.04-1.3-.13-2.47-.13-2.44 0-4.11 1.49-4.11 4.23v2.36H7.44v3.19h2.75V21h3.31z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 4.16c2.56 0 2.87.01 3.88.06 1.94.09 2.85.99 2.94 2.94.05 1.01.06 1.32.06 3.88s-.01 2.87-.06 3.88c-.09 1.94-.99 2.85-2.94 2.94-1.01.05-1.32.06-3.88.06s-2.87-.01-3.88-.06c-1.94-.09-2.85-.99-2.94-2.94C5.13 14.85 5.12 14.54 5.12 12s.01-2.87.06-3.88c.09-1.94.99-2.85 2.94-2.94C9.13 4.17 9.44 4.16 12 4.16zM12 2C9.4 2 9.07 2.01 8.05 2.06 5.45 2.18 4.01 3.62 3.89 6.22 3.84 7.24 3.83 7.57 3.83 12s.01 4.76.06 5.78c.12 2.6 1.56 4.04 4.16 4.16C9.07 21.99 9.4 22 12 22s2.93-.01 3.95-.06c2.6-.12 4.04-1.56 4.16-4.16.05-1.02.06-1.35.06-5.78s-.01-4.76-.06-5.78c-.12-2.6-1.56-4.04-4.16-4.16C14.93 2.01 14.6 2 12 2z" />
      <path d="M12 6.87A5.13 5.13 0 1 0 17.13 12 5.14 5.14 0 0 0 12 6.87zm0 8.46A3.33 3.33 0 1 1 15.33 12 3.34 3.34 0 0 1 12 15.33z" />
      <circle cx="17.34" cy="6.66" r="1.2" />
    </svg>
  );
}

function SoundCloudIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* waveform bars */}
      <rect x="1.5" y="12" width="1.3" height="4" />
      <rect x="3.8" y="10.3" width="1.3" height="5.7" />
      <rect x="6.1" y="9" width="1.3" height="7" />
      <rect x="8.4" y="10.6" width="1.3" height="5.4" />
      {/* cloud */}
      <path d="M11 16V8.7a3.6 3.6 0 0 1 2.1-.68 3.75 3.75 0 0 1 3.74 3.5 2.9 2.9 0 0 1 .9-.14 2.81 2.81 0 0 1 0 5.62H11z" />
    </svg>
  );
}

const SOCIALS = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/antennerecordshop/",
    Icon: FacebookIcon,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/antenne.recordshop/",
    Icon: InstagramIcon,
  },
  {
    label: "SoundCloud",
    href: "https://soundcloud.com/antennerecordshoptilburg",
    Icon: SoundCloudIcon,
  },
] as const;

export default function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex items-center gap-3 ${className}`.trim()}>
      {SOCIALS.map(({ label, href, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="flex h-11 w-11 items-center justify-center border border-hairline text-ink-muted transition-colors hover:border-signal hover:text-signal"
          >
            <Icon />
          </a>
        </li>
      ))}
    </ul>
  );
}
