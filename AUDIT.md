# Verificación de la consolidación

Firebase es la única fuente de carga. Se han retirado las lecturas de Google Sheets, la recuperación automática de responsables y las capas duplicadas de renderizado. Se conservan íntegros los registros recibidos, incluidos sus identificadores y las personas añadidas.

Pruebas de navegador con datos simulados y red externa bloqueada: arranque, cuatro vistas, categorías, personas, clientes, estados, fechas, búsqueda, limpieza de filtros, identificación del registro al editar, conservación de filtros al recargar, guardado simulado sin cambiar la fecha, documento vacío o ausente, fallo de lectura y directorio incompleto. Capturas a 390, 768 y 1440 píxeles. Sin escrituras en Firebase ni cambios en la hoja original.

Los formularios conservan su capacidad de guardar cuando la usuaria los utiliza. Las pruebas de este cambio no guardan datos reales.
