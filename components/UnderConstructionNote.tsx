type UnderConstructionNoteProps = {
  tone?: "default" | "dark";
};

export function UnderConstructionNote({ tone = "default" }: UnderConstructionNoteProps) {
  return (
    <aside className={`under-construction-note under-construction-note--${tone}`} aria-label="Under construction notice">
      <span>Site update</span>
      <p><strong>Under construction.</strong> This section is still being built.</p>
    </aside>
  );
}
