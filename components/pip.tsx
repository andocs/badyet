// Pip, the coin mascot. Decorative; smiles bigger when everything is sent.
export function Pip({ happy = false }: { happy?: boolean }) {
  return (
    <svg className={`pip${happy ? " happy" : ""}`} viewBox="0 0 120 120" role="img" aria-label="Pip the coin mascot">
      <ellipse cx="60" cy="112" rx="30" ry="5" fill="#000" opacity="0.15" />
      <circle cx="60" cy="62" r="46" fill="#F2B100" />
      <circle cx="60" cy="62" r="36" fill="#FFD24D" />
      <circle cx="60" cy="62" r="36" fill="none" stroke="#E09A00" strokeWidth="2" strokeDasharray="3 6" />
      <ellipse cx="46" cy="57" rx="5" ry="7" fill="#10302B" />
      <ellipse cx="74" cy="57" rx="5" ry="7" fill="#10302B" />
      <circle cx="47.5" cy="54" r="1.8" fill="#fff" />
      <circle cx="75.5" cy="54" r="1.8" fill="#fff" />
      <circle cx="37" cy="71" r="6" fill="#FF8A66" opacity="0.7" />
      <circle cx="83" cy="71" r="6" fill="#FF8A66" opacity="0.7" />
      <path className="smile" d="M51 75 Q60 81 69 75" stroke="#10302B" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path className="smile-big" d="M49 71 Q60 89 71 71 Z" fill="#10302B" />
      <path d="M60 16 L60 8" stroke="#2E9E5B" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 8 Q48 0 42 10 Q54 16 60 8Z" fill="#34D399" />
      <path d="M60 8 Q72 0 78 10 Q66 16 60 8Z" fill="#2E9E5B" />
    </svg>
  );
}
