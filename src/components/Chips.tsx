type Props<T extends string> = { options: { key: T; label: string }[]; value: T; onChange: (k: T) => void };

export default function Chips<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.key} type="button" className={`chip${value === o.key ? ' on' : ''}`} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
