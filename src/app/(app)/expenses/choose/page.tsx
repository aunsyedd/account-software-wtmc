import Link from "next/link";

export default function ChooseExpensePage() {
  return (
    <>
      <div className="page-head">
        <h1>Add expense</h1>
        <Link className="btn btn-gray" href="/expenses">
          ← Back
        </Link>
      </div>
      <div className="card" style={{ maxWidth: 640 }}>
        <p>Choose the type of expense to log.</p>
        <p>
          <Link className="btn btn-green" href="/expenses/new?type=expense">
            Expense (services / overhead)
          </Link>
        </p>
        <p className="hint">
          Use this for rent, utilities, professional fees and other costs that are not inventory.
        </p>
        <p>
          <Link className="btn btn-orange" href="/expenses/new?type=purchase_bill">
            Purchase bill (inventory)
          </Link>
        </p>
        <p className="hint">
          Use this when you buy stock. Purchased units are added to available inventory.
        </p>
      </div>
    </>
  );
}
