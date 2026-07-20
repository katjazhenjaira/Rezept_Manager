type Props = {
  onGoToLogin: () => void;
  onGoToSignup: () => void;
};

export function LandingPage({ onGoToLogin, onGoToSignup }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Rezept Manager</h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            Умная кулинарная книга с планером питания и AI-диетологом. Считайте КБЖУ, планируйте
            меню и получайте персональные рекомендации.
          </p>
        </div>
        <div className="space-y-3">
          <button
            onClick={onGoToLogin}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Войти
          </button>
          <button
            onClick={onGoToSignup}
            className="w-full bg-white text-blue-600 border border-blue-600 py-3 rounded-xl font-medium hover:bg-blue-50 transition-colors"
          >
            Зарегистрироваться
          </button>
        </div>
      </div>
    </div>
  );
}
