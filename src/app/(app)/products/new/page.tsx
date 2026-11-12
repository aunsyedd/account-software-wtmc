import Link from "next/link";
import { ProductForm } from "@/components/ProductForm";

export default function NewProductPage() {
  return (
    <>
      <div className="page-head">
        <h1>Add product</h1>
        <Link className="btn btn-gray" href="/products">
          ← Back to products
        </Link>
      </div>
      <ProductForm />
    </>
  );
}
