# Revisión de uso y seguridad — Centro Fuenlabrada

## Cambios

- El formulario permanece abierto hasta que Firebase confirma el guardado. Los errores no sustituyen el borrador por datos anteriores.
- Cada alta, modificación o borrado realiza una escritura condicionada a la versión leída. Si otra sesión modificó los datos, se rechaza la sobrescritura y se informa del conflicto.
- Si se pierde una respuesta después de guardar, el reintento comprueba el identificador de la operación antes de repetirla.
- Se conservan los campos originales del documento, incluidos los no utilizados por la interfaz.
- El borrado elimina realmente el registro; las nuevas actividades y gestiones no dependen de números de fila de Sheets.
- Las importaciones crean bloques nuevos. El directorio activo cambia solo al terminar, con control de versión. Los bloques anteriores permanecen y se guarda el manifiesto anterior.
- Se rechazan archivos con encabezados distintos y directorios incompletos. No se muestra una importación fallida como exitosa.
- Los datos de una lectura antigua en curso no sustituyen una escritura posterior.
- Los formularios avisan antes de descartar cambios. Las peticiones tienen un tiempo de espera máximo.
- Se han retirado rutas antiguas de escritura, cargas locales de registros y funciones duplicadas de modificación.
- Los colores se calculan desde la lista completa de nombres de Firebase, de manera coherente entre dispositivos. Los filtros no cambian la asignación; nuevas personas pueden modificar el reparto alfabético.
- Estados, mensajes vacíos y botones se presentan de forma coherente. Las etiquetas de estado y edición no se parten dentro de una palabra.

## Verificación

Pruebas en Chrome con todas las operaciones de Firebase interceptadas por una base simulada: alta, modificación, borrado, una escritura por operación, conservación de campos desconocidos y fechas, fallo de conexión, reintento, conflicto con otra sesión, pérdida de la respuesta de guardado, importación interrumpida después de un bloque, importación correcta, recarga del nuevo directorio, filtros y colores entre dispositivos.

La lectura real sin autenticación de appState/main devuelve 403. No se han modificado datos de Firebase ni la hoja original. La revisión no sustituye una inspección completa de las reglas desplegadas de Firebase; la importación y el guardado reales no se han probado con registros de producción.

## Al comenzar a usar la actualización

Recargar la página en todos los dispositivos y cerrar pestañas antiguas antes de editar. Una pestaña que conserve código anterior no incorpora las nuevas protecciones. Si aparece un conflicto, no se sobrescriben datos: se conserva el formulario para revisar los cambios.

La protección frente a conflictos usa las [condiciones de escritura de Firestore](https://firebase.google.com/docs/firestore/reference/rest/v1/Precondition).
