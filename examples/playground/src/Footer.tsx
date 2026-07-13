export function Footer({ resetDemo }: { resetDemo?: () => Promise<void> }) {
  return (
    <footer className="footer">
      <a
        href="https://github.com/Invalid8/better-content"
        target="_blank"
        rel="noreferrer"
      >
        github.com/Invalid8/better-content
      </a>
      <span>MIT · independent project</span>
      <button
        className="reset"
        disabled={!resetDemo}
        onClick={() => void resetDemo?.()}
      >
        Reset demo content
      </button>
    </footer>
  );
}
