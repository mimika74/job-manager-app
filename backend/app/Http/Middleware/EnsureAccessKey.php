<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

/**
 * Googleアカウントを持たない第三者にAPIを一時的に見せるための、
 * 共有アクセスキーによる簡易ゲート。
 *
 * 受け付ける渡し方は2通り:
 *  1) HTTP Basic認証(ユーザー名は任意、パスワード欄にアクセスキー) — curl/Postman向け
 *  2) `X-Access-Key` ヘッダー — ブラウザのfetchはクロスオリジンだと
 *     Basic認証の標準ダイアログが安定して出ないため、SPA側はこちらを使う
 */
class EnsureAccessKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $expectedKey = config('access.key');

        // ACCESS_KEY未設定なら保護しない(ローカル開発では従来通り素通り)
        if (blank($expectedKey)) {
            return $next($request);
        }

        $expiresAt = config('access.expires_at');
        if (filled($expiresAt) && now()->greaterThan(Carbon::parse($expiresAt))) {
            return $this->deny('このアクセスキーの有効期限が切れています。');
        }

        $providedKey = $request->getPassword() ?? $request->header('X-Access-Key');

        if (! is_string($providedKey) || ! hash_equals((string) $expectedKey, $providedKey)) {
            return $this->deny('アクセスキーが正しくありません。');
        }

        return $next($request);
    }

    private function deny(string $message): Response
    {
        return response()->json(['message' => $message], 401, [
            'WWW-Authenticate' => 'Basic realm="Access Key Required"',
        ]);
    }
}
