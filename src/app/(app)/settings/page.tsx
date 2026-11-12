import { deleteCategory, saveCategory, saveCompany } from "@/app/actions";
import { getCategories, getCompany } from "@/lib/queries";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { SubmitButton } from "@/components/SubmitButton";

export default async function SettingsPage() {
  const [company, categories] = await Promise.all([getCompany(), getCategories()]);
  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="k">VAT</div>
          <div className="v">15%</div>
        </div>
        <div className="stat">
          <div className="k">Currency</div>
          <div className="v">&#x20C1; SAR</div>
        </div>
      </div>
      <p className="hint" style={{ marginBottom: 16 }}>
        VAT 15% is added automatically on invoices and purchases. Example: &#x20C1;&nbsp;10.00 becomes &#x20C1;&nbsp;11.50.
      </p>
      <h2 className="report-title">Company details</h2>
      <form action={saveCompany} className="form">
        <input type="hidden" name="id" value={company.id} />
        <div className="grid-2">
          <div className="field">
            <label>Display name</label>
            <input name="name" defaultValue={company.name} />
          </div>
          <div className="field">
            <label>Legal name</label>
            <input name="legal_name" defaultValue={company.legal_name || ""} />
          </div>
          <div className="field">
            <label>Email</label>
            <input name="email" defaultValue={company.email || ""} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input name="phone" defaultValue={company.phone || ""} />
          </div>
          <div className="field full">
            <label>Address</label>
            <textarea name="address" defaultValue={company.address || ""} />
          </div>
          <div className="field">
            <label>City</label>
            <input name="city" defaultValue={company.city || ""} />
          </div>
          <div className="field">
            <label>Country</label>
            <input name="country" defaultValue={company.country || ""} />
          </div>
          <div className="field">
            <label>Tax number</label>
            <input name="tax_number" defaultValue={company.tax_number || ""} />
          </div>
          <div className="field">
            <label>Currency code</label>
            <input name="currency_code" defaultValue={company.currency_code || "SAR"} placeholder="SAR" />
          </div>
          <div className="field">
            <label>Currency symbol</label>
            <input name="currency_symbol" defaultValue={company.currency_symbol || "SAR"} placeholder="SAR" />
          </div>
          <div className="field">
            <label>Invoice prefix</label>
            <input name="invoice_prefix" defaultValue={company.invoice_prefix} />
          </div>
          <div className="field">
            <label>Default notes</label>
            <textarea name="default_notes" defaultValue={company.default_notes || ""} />
          </div>
          <div className="field">
            <label>Default terms</label>
            <textarea name="default_terms" defaultValue={company.default_terms || ""} />
          </div>
        </div>
        <SubmitButton className="btn btn-green" pendingLabel="Saving…">
            Save
          </SubmitButton>
      </form>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Expense categories</h2>
      <form action={saveCategory} className="toolbar">
        <input name="name" placeholder="New category" required />
        <SubmitButton className="btn btn-green" pendingLabel="Adding…">
            Add category
          </SubmitButton>
      </form>
      <table className="data" style={{ maxWidth: 520 }}>
        <thead>
          <tr>
            <th>Category</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c: { id: string; name: string }) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td className="actions">
                <ConfirmDelete action={deleteCategory} id={c.id} what={`category ${c.name}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
