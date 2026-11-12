import Link from "next/link";
import { saveClient } from "@/app/actions";
import { PartyForm } from "@/components/PartyForm";

export default function NewClientPage() {
  return (
    <>
      <div className="page-head">
        <h1>Add client</h1>
        <Link className="btn btn-gray" href="/clients">
          ← Back
        </Link>
      </div>
      <PartyForm action={saveClient} kind="client" />
    </>
  );
}
