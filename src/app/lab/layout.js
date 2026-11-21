export const metadata = {
  // Absolute so the catalog storefront's title template isn't appended.
  title: { absolute: 'Lab portal | Peptide Empire' },
  robots: { index: false, follow: false },
};

export default function LabLayout({ children }) {
  return children;
}
