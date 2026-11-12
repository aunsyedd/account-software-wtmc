import { SubmitButton } from "@/components/SubmitButton";
type Party = {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  tax_number?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  opening_balance?: number;
  notes?: string | null;
};

export function PartyForm({
  party,
  action,
  kind,
}: {
  party?: Party;
  action: (formData: FormData) => void | Promise<void>;
  kind: "client" | "vendor";
}) {
  return (
    <form action={action} className="form">
      {party?.id ? <input type="hidden" name="id" value={party.id} /> : null}
      <div className="grid-2">
        <div className="field">
          <label>{kind === "client" ? "Client" : "Vendor"} name *</label>
          <input name="name" required defaultValue={party?.name || ""} />
        </div>
        <div className="field">
          <label>Email</label>
          <input name="email" type="email" defaultValue={party?.email || ""} />
        </div>
        <div className="field">
          <label>Phone</label>
          <input name="phone" defaultValue={party?.phone || ""} />
        </div>
        <div className="field">
          <label>VAT / tax number</label>
          <input name="tax_number" defaultValue={party?.tax_number || ""} />
        </div>
        <div className="field full">
          <label>Address</label>
          <textarea name="address" defaultValue={party?.address || ""} />
        </div>
        <div className="field">
          <label>City</label>
          <input name="city" defaultValue={party?.city || ""} />
        </div>
        <div className="field">
          <label>Country</label>
          <input name="country" defaultValue={party?.country || ""} />
        </div>
        <div className="field">
          <label>Opening balance</label>
          <input
            name="opening_balance"
            type="number"
            step="0.01"
            defaultValue={party?.opening_balance ?? 0}
          />
        </div>
        <div className="field full">
          <label>Notes</label>
          <textarea name="notes" defaultValue={party?.notes || ""} />
        </div>
      </div>
      <div className="btn-row">
        <SubmitButton className="btn btn-green">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
