// Módulos permitidos para roles restringidos. Los roles que NO aparecen aquí
// (staff, recepcion, contabilidad, consulta) tienen acceso completo por
// default: no hay especificación de negocio para restringirlos más fino sin
// arriesgar bloquear trabajo real, así que solo se restringe lo que es
// inequívocamente seguro — un mecánico no tiene motivo para entrar a Cajas,
// Facturación, Proveedores o Administración.
const ROLE_MODULES = {
  mecanico: ['vehiculo'],
};

// true → el rol puede ver/acceder al módulo. Un rol sin entrada en
// ROLE_MODULES no tiene restricciones (ver nota arriba).
export function canSeeModule(role, module) {
  if (!ROLE_MODULES[role]) return true;
  return ROLE_MODULES[role].includes(module);
}
