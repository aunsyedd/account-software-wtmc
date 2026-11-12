import Link from "next/link";
import { EmployeeForm } from "@/components/EmployeeForm";

export default function NewEmployeePage() {
  return (
    <>
      <div className="page-head">
        <h1>Add employee</h1>
        <Link className="btn btn-gray no-print" href="/employees">
          ← Back
        </Link>
      </div>
      <EmployeeForm />
    </>
  );
}
