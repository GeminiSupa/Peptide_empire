export const metadata = {
  // Absolute so the catalog storefront's title template isn't appended.
  title: { absolute: 'Admin | Peptide Empire' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return children;
}
