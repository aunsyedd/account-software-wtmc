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

/** Quote text for a CSS `content` string (also safe inside a <style> tag). */
function cssString(text: string) {
  return (
    '"' +
    text
      .replace(/[\r\n]+/g, " ")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/</g, "\\3c ") +
    '"'
  );
}

/**
 * Letterhead shown only on printed pages / saved PDFs. It also sets the page footer
 * (company · document title on the left, "Page X of Y" on the right) on every page.
 */
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
  const companyName = company.legal_name || company.name || "";
  const footerLeft = [companyName, title, subtitle].filter(Boolean).join("  ·  ");
  const pageCss = `@page {
  @bottom-left { content: ${cssString(footerLeft)}; font-size: 7.5pt; color: #666; vertical-align: top; padding-top: 3mm; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 7.5pt; color: #666; vertical-align: top; padding-top: 3mm; }
}`;
  return (
    <div className="print-only print-letterhead">
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />
      <div className="pl-company">
        <span className="pl-logo">
          <BrandMark />
        </span>
        <div>
          <div className="pl-name">{companyName}</div>
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
