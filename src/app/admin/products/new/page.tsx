import ProductForm from "@/components/admin/ProductForm";
import AdminShell from "@/components/admin/AdminShell";

export default function NewProductPage() {
  return (
    <AdminShell>
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Add New Product</h1>
      <ProductForm />
    </div>
    </AdminShell>
  );
}
