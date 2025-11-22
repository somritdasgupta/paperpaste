export default function Footer() {
  return (
    <footer className="w-full py-4 px-6 border-t border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>© 2024 PaperPaste. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <a 
            href="https://somritdasgupta.in" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            by @somritdasgupta
          </a>
          <span>•</span>
          <a 
            href="https://github.com/somritdasgupta/paperpaste" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
