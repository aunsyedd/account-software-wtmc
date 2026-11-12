import { saveProduct } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

type Product = {
  id?: string;
  name?: string;
  description?: string | null;
  unique_code?: string | null;
  barcode?: string | null;
  hsn_code?: string | null;
  unit?: string;
  unit_selling_price?: number;
  unit_purchase_price?: number;
  tax_name?: string | null;
  tax_rate?: number;
  track_inventory?: boolean;
  opening_stock?: number;
  reorder_level?: number;
};

export function ProductForm({ product }: { product?: Product }) {
  return (
    <form action={saveProduct} className="form">
      {product?.id ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="grid-2">
        <div className="field">
          <label>Product name *</label>
          <input name="name" required defaultValue={product?.name || ""} />
        </div>
        <div className="field">
          <label>Unique code / barcode</label>
          <input name="unique_code" defaultValue={product?.unique_code || product?.barcode || ""} />
        </div>
        <div className="field full">
          <label>Description</label>
          <textarea name="description" defaultValue={product?.description || ""} />
        </div>
        <div className="field">
          <label>HSN / SAC / customs code</label>
          <input name="hsn_code" defaultValue={product?.hsn_code || ""} />
        </div>
        <div className="field">
          <label>Unit of measure</label>
          <input name="unit" defaultValue={product?.unit || "pcs"} />
        </div>
        <div className="field">
          <label>Unit selling price *</label>
          <input
            name="unit_selling_price"
            type="number"
            step="0.01"
            required
            defaultValue={product?.unit_selling_price ?? 0}
          />
        </div>
        <div className="field">
          <label>Unit purchase price</label>
          <input
            name="unit_purchase_price"
            type="number"
            step="0.01"
            defaultValue={product?.unit_purchase_price ?? 0}
          />
        </div>
        <div className="field">
          <label>Tax name</label>
          <input name="tax_name" placeholder="VAT" defaultValue={product?.tax_name || "VAT"} />
        </div>
        <div className="field">
          <label>VAT rate %</label>
          <input name="tax_rate" type="number" step="0.01" defaultValue={product?.tax_rate ?? 15} />
        </div>
      </div>
      <label className="check">
        <input
          type="checkbox"
          name="track_inventory"
          defaultChecked={product?.track_inventory !== false}
        />
        Set-up available units tracking / opening stock
      </label>
      <div className="grid-2">
        <div className="field">
          <label>Opening stock (available units)</label>
          <input
            name="opening_stock"
            type="number"
            step="0.001"
            defaultValue={product?.opening_stock ?? 0}
          />
        </div>
        <div className="field">
          <label>Reorder level</label>
          <input
            name="reorder_level"
            type="number"
            step="0.001"
            defaultValue={product?.reorder_level ?? 0}
          />
        </div>
      </div>
      <p className="hint">
        After invoicing, sold units are reduced from available units automatically. Logging a
        purchase bill increases purchased units.
      </p>
      <div className="btn-row">
        <SubmitButton className="btn btn-green" name="intent" value="exit">
          Save &amp; Exit
        </SubmitButton>
        <SubmitButton className="btn btn-orange" name="intent" value="purchase">
          Save &amp; add purchases
        </SubmitButton>
        <SubmitButton className="btn btn-gray" name="intent" value="new">
          Save &amp; add new product
        </SubmitButton>
      </div>
    </form>
  );
}
