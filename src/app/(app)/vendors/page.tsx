import Link from "next/link";
import { deleteVendor } from "@/app/actions";
import { getCompany, getVendors } from "@/lib/queries";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { displayDate, todayISO } from "@/lib/format";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export default async function VendorsPage() {
  const [vendors, company] = await Promise.all([getVendors(), getCompany()]);
  return (
    <>
      <PrintHeader company={company} title="Vendor list" subtitle={`${vendors.length} vendors · ${displayDate(todayISO())}`} />
      <div className="page-head">
        <h1>Vendors</h1>
        <div className="head-actions no-print">
          <PrintButton filename="Vendor list" />
          <Link className="btn btn-green" href="/vendors/new">
            + Add vendor
          </Link>
        </div>
      </div>
      <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Tax number</th>
            <th>City</th>
            <th className="no-print">Actions</th>
          </tr>
        </thead>
        <tbody>
          {vendors.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                No vendors yet.
              </td>
            </tr>
          ) : (
            vendors.map(
              (v: {
                id: string;
                name: string;
                email: string | null;
                phone: string | null;
                tax_number: string | null;
                city: string | null;
              }) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/vendors/${v.id}`}>{v.name}</Link>
                  </td>
                  <td>{v.email}</td>
                  <td>{v.phone}</td>
                  <td>{v.tax_number}</td>
                  <td>{v.city}</td>
                  <td className="actions no-print">
                    <Link href={`/vendors/${v.id}`}>Edit</Link>
                    <ConfirmDelete action={deleteVendor} id={v.id} what={`vendor ${v.name}`} />
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}
