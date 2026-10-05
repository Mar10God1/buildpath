export function BuildPathLogo({compact=false}:{compact?:boolean}) {
  return (
    <div className={compact ? "bp-logo compact" : "bp-logo"}>
      <span className="bp-logo-mark" aria-hidden="true"><i/><b/><em/></span>
      {!compact && <span className="bp-logo-word"><strong>Build</strong><strong>Path</strong></span>}
    </div>
  );
}
