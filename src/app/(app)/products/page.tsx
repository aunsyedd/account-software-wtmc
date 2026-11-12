import { ProductList } from "@/components/ProductList";
import { getCompany, getProducts, getSalesDetails } from "@/lib/queries";

export default async function ProductsPage() {
  const [products, sales, company] = await Promise.all([
    getProducts(),
    getSalesDetails(),
    getCompany(),
  ]);
  return (
    <ProductList
      products={products}
      sales={sales}
      symbol={company.currency_symbol}
    />
  );
}
