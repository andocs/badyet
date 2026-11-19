// A plain wallet dropdown for forms. Blank value means "no wallet".
export function WalletSelect({
  wallets,
  value = "",
  disabled,
  label,
  name = "walletId",
}: {
  wallets: { id: string; name: string }[];
  value?: string;
  disabled?: boolean;
  label: string;
  name?: string;
}) {
  return (
    <select className="input" name={name} defaultValue={value} disabled={disabled} aria-label={label}>
      <option value="">No wallet</option>
      {wallets.map((w) => (
        <option key={w.id} value={w.id}>{w.name}</option>
      ))}
    </select>
  );
}
