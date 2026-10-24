import { Sheet } from "./Sheets";

/** Plain-words account of where the nutrition figures come from and how far to trust them. */
export function NumbersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="How the numbers are worked out">
      <p className="k-sub">They're good estimates, not measurements. They're built to compare one day with another and keep you in the right range, not to count to the gram.</p>

      <h3 className="section-label">Solid</h3>
      <ul className="reasons">
        <li>Energy, protein, carbohydrate, sugar, fats (total, saturated, mono- and polyunsaturated), cholesterol, sodium and total fibre for each food come from the USDA food database, which is laboratory-analysed and public. Plant sterols are only recorded there for a few foods, so most meals show them as "not known".</li>
        <li>Anything you scan from a pack uses the numbers printed on that pack, per 100 g.</li>
      </ul>

      <h3 className="section-label">Estimated</h3>
      <ul className="reasons">
        <li><b>Soluble fibre and beta-glucan.</b> Food databases don't publish them, so these are typical values for each food. Treat them as a guide.</li>
        <li><b>Portions.</b> "Half a cup" is a typical weight. Your cup may hold a bit more or less.</li>
        <li><b>Suppers and takeaways.</b> Typical plate sizes. They tell a light night from a heavy one, not an exact amount.</li>
        <li><b>"Something else" and extras.</b> Rough guesses by kind and size, counted for saturated fat and sodium only.</li>
      </ul>

      <h3 className="section-label">How close</h3>
      <p className="k-sub">Expect any one meal to be out by about a fifth either way. Over a week the patterns are reliable even where a single number isn't.</p>

      <h3 className="section-label">Your limits</h3>
      <ul className="reasons">
        <li><b>Saturated fat</b> is 6% of your daily energy, in line with common guidance for people lowering LDL cholesterol, such as the American Heart Association's.</li>
        <li><b>Energy</b> comes from the Mifflin-St Jeor equation with an activity factor. It's usually within about a tenth.</li>
        <li><b>Sodium</b> is 2,000 mg a day, the WHO's upper limit.</li>
        <li><b>Soluble fibre</b> aims for about 10 g a day including 3 g of oat or barley beta-glucan, the amount linked with lowering LDL in trials and used in heart-health claims. Daytime meals are asked for 7 g and supper covers the rest.</li>
      </ul>
      <p className="k-sub">This isn't medical advice. If your doctor or dietitian gives you a different number, theirs comes first, and I'll change the app to match.</p>
    </Sheet>
  );
}
