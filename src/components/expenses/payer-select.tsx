import { SelectInput } from "../ui/select-input";

export const LANDLORD_PAYER_VALUE = "landlord";

export function PayerSelect({
  name,
  members,
  currentMemberId,
  landlordEnabled,
  defaultValue,
  disabled,
  onValueChange,
}: {
  name: string;
  members: Array<{ id: string; name: string }>;
  currentMemberId: string;
  landlordEnabled: boolean;
  defaultValue?: string | null;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const selected =
    defaultValue &&
    (defaultValue === LANDLORD_PAYER_VALUE || members.some((member) => member.id === defaultValue))
      ? defaultValue
      : currentMemberId;
  return (
    <SelectInput
      name={name}
      defaultValue={selected}
      ariaLabel="Paid by"
      disabled={disabled}
      onValueChange={onValueChange}
      options={[
        ...members.map((member) => ({ value: member.id, label: member.name })),
        ...(landlordEnabled || defaultValue === LANDLORD_PAYER_VALUE
          ? [{ value: LANDLORD_PAYER_VALUE, label: "Landlord" }]
          : []),
      ]}
    />
  );
}
