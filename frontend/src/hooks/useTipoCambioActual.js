import { useEffect, useState } from "react";
import { getUltimoTipoCambio } from "../api/configuracion";

// Tipo de cambio vigente, definido en Configuración. Los formularios que
// requieren el dólar lo toman de aquí en modo solo-lectura.
export default function useTipoCambioActual() {
  const [tipoCambio, setTipoCambio] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;

    getUltimoTipoCambio()
      .then((data) => {
        if (activo) setTipoCambio(Number(data?.valor || 0));
      })
      .catch(() => {
        if (activo) setTipoCambio(0);
      })
      .finally(() => {
        if (activo) setLoading(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  return { tipoCambio, loading };
}
