import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as handlebars from 'handlebars';

/** Resolve Handlebars template directory for dev and prod builds. */
export function resolveMailTemplateDir(): string {
  const candidates = [
    join(process.cwd(), 'src', 'mail', 'templates'),
    join(process.cwd(), 'dist', 'mail', 'templates'),
    join(process.cwd(), 'src', 'templates'),
    join(__dirname, 'templates'),
    join(__dirname, '..', 'mail', 'templates'),
  ];
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0];
}

/** Compile a Handlebars template (e.g. `./booking-confirmed`) to HTML. */
export function compileMailTemplate(
  templateRef: string,
  context: Record<string, unknown> = {},
): string {
  const name = templateRef.replace(/^\.\//, '').replace(/\.hbs$/, '');
  const dir = resolveMailTemplateDir();
  const filePath = join(dir, `${name}.hbs`);
  if (!existsSync(filePath)) {
    throw new Error(`Mail template not found: ${filePath}`);
  }
  const source = readFileSync(filePath, 'utf8');
  return handlebars.compile(source, { strict: true })(context);
}
