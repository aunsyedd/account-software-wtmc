import { notFound } from "next/navigation";
import Link from "next/link";
import { saveVendor } from "@/app/actions";
import { PartyForm } from "@/components/PartyForm";
import { getVendors } from "@/lib/queries";

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vendors = await getVendors();
  const vendor = vendors.find((v: { id: string }) => v.id === id);
  if (!vendor) notFound();
  return (
    <>
      <div className="page-head">
        <h1>Edit vendor</h1>
        <Link className="btn btn-gray" href="/vendors">
          ← Back
        </Link>
      </div>
      <PartyForm action={saveVendor} kind="vendor" party={vendor} />
    </>
  );
}
