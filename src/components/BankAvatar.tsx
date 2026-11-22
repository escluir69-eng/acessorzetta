import { Landmark } from 'lucide-react';

const banks = [ ['nubank', 'nu', 'nubank'], ['itaú', 'itaú', 'itau'], ['itau', 'itaú', 'itau'], ['bradesco', 'B', 'bradesco'], ['banco do brasil', 'BB', 'bb'], ['santander', 'S', 'santander'], ['inter', 'inter', 'inter'], ['caixa', 'X', 'caixa'], ['xp', 'XP', 'xp'], ['btg', 'btg', 'btg'], ['mercado pago', 'MP', 'mp'] ] as const;
export function BankAvatar({ institution }: { institution: string }) {
  const bank = banks.find(([name]) => institution.toLocaleLowerCase('pt-BR').includes(name));
  return <span title={institution} aria-label={institution} className={`bank-avatar bank-${bank?.[2] ?? 'default'} grid size-10 shrink-0 place-items-center rounded-lg text-xs font-extrabold`}>{bank?.[1] ?? <Landmark className="size-5" />}</span>;
}