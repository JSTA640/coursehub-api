// @nestjs/throttler se publica como CommonJS y hace require() de @nestjs/common (ESM).
// El cargador ESM de Jest rechaza ese require() si @nestjs/common aún se está enlazando;
// evaluarlo antes de cada suite rompe el ciclo. En Node real no hace falta.
await import('@nestjs/common');
await import('@nestjs/core');
