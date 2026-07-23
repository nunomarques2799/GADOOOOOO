/**
 * `xlsx-js-style` é um fork do SheetJS com a mesma API de `xlsx`, mais o
 * suporte a estilos de célula (a propriedade `s`). O pacote não traz tipos
 * próprios — reaproveitamos os do `xlsx`, que já está instalado.
 */
declare module 'xlsx-js-style' {
  export * from 'xlsx';
}
