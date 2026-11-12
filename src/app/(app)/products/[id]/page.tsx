import Link from "next/link";
import { ProductForm } from "@/components/ProductForm";
import { getProduct } from "@/lib/queries";
import { money, qty } from "@/lib/format";
import { getCompany } from "@/lib/queries";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, company] = await Promise.all([getProduct(id), getCompany()]);
  return (
    <>
      <div className="page-head">
        <h1>Edit product</h1>
        <Link className="btn btn-gray" href="/products">
          ← Back to products
        </Link>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="k">Available units</div>
          <div className="v">{qty(product.available_units)}</div>
        </div>
        <div className="stat">
          <div className="k">Sold units</div>
          <div className="v">{qty(product.sold_units)}</div>
        </div>
        <div className="stat">
          <div className="k">Purchased units</div>
          <div className="v">{qty(product.purchased_units)}</div>
        </div>
        <div className="stat">
          <div className="k">Selling price</div>
          <div className="v">{money(product.unit_selling_price, company.currency_symbol)}</div>
        </div>
      </div>
      <ProductForm product={product} />
    </>
  );
}
