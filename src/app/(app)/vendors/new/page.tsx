import Link from "next/link";
import { saveVendor } from "@/app/actions";
import { PartyForm } from "@/components/PartyForm";

export default function NewVendorPage() {
  return (
    <>
      <div className="page-head">
        <h1>Add vendor</h1>
        <Link className="btn btn-gray" href="/vendors">
          ← Back
        </Link>
      </div>
      <PartyForm action={saveVendor} kind="vendor" />
    </>
  );
}
