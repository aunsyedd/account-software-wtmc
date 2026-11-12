import { BrandMark } from "@/components/BrandMark";
import { displayDate, todayISO } from "@/lib/format";

type Company = {
  name?: string | null;
  legal_name?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_number?: string | null;
};

/** Letterhead shown only on printed pages / saved PDFs. */
export function PrintHeader({
  company,
  title,
  subtitle,
}: {
  company: Company;
  title: string;
  subtitle?: string;
}) {
  const address = [company.address, company.city, company.country].filter(Boolean).join(", ");
  const contact = [company.phone, company.email].filter(Boolean).join(" · ");
  return (
    <div className="print-only print-letterhead">
      <div className="pl-company">
        <span className="pl-logo">
          <BrandMark />
        </span>
        <div>
          <div className="pl-name">{company.legal_name || company.name}</div>
          {address ? <div>{address}</div> : null}
          {contact ? <div>{contact}</div> : null}
          {company.tax_number ? <div>VAT No. {company.tax_number}</div> : null}
        </div>
      </div>
      <div className="pl-doc">
        <div className="pl-title">{title}</div>
        {subtitle ? <div>{subtitle}</div> : null}
        <div>Printed {displayDate(todayISO())}</div>
      </div>
    </div>
  );
}
