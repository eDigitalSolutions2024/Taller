import { Outlet } from "react-router-dom";
import "../../styles/clientes.css";

export default function ClientesLayout() {
  return (
    <div className="clientes-wrap">
      
      <div className="clientes-content">
        <Outlet />
      </div>
    </div>
  );
}
 