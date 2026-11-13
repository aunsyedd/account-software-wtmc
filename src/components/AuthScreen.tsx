import { BrandMark } from "./BrandMark";
import { Icon } from "./Icon";

const features = [
  "Invoices with automatic 15% VAT",
  "Live stock levels and reorder alerts",
  "Expenses, vendors and purchase bills",
  "VAT, profit & loss and payroll reports",
];

export function AuthScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth">
      <section className="auth-brand" aria-hidden>
        <div className="auth-grid" />
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-brand-inner">
          <div className="auth-logo">
            <BrandMark animated />
          </div>
          <h2>
            Washika Tabassum
            <span>Accounts Software</span>
          </h2>
          <p>One place to run sales, stock, purchases and payroll — accurate to the last halala.</p>
          <ul className="auth-features">
            {features.map((f, i) => (
              <li key={f} style={{ animationDelay: `${0.9 + i * 0.12}s` }}>
                <span className="tick">
                  <Icon name="check" size={14} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-brand-foot">© {new Date().getFullYear()} Washika Tabassum Marwah Co. · Kingdom of Saudi Arabia</div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-logo">
            <BrandMark animated />
            <span>
              Washika Tabassum
              <small>Accounts Software</small>
            </span>
          </div>
          <h1>{title}</h1>
          <p className="auth-sub">{subtitle}</p>
          {children}
        </div>
        <p className="auth-secure">
          <Icon name="lock" size={14} /> Secured, encrypted session
        </p>
      </section>
    </div>
  );
}
