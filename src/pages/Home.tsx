export default function Home() {
  return (
    <div className="px-4 py-6 space-y-6">
      <div className="card">
        <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Season</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">--%</p>
        <p className="text-sm text-gray-500 mt-0.5">No kicks recorded yet</p>
      </div>

      <div className="card">
        <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Last Session</p>
        <p className="text-gray-600 mt-2">No sessions recorded.</p>
      </div>

      <div className="card">
        <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Quick Actions</p>
        <div className="mt-3 space-y-2">
          <a href="/record" className="btn-primary block text-center w-full">
            Start Recording Kicks
          </a>
          <a href="/athletes" className="btn-secondary block text-center w-full">
            Manage Athletes
          </a>
        </div>
      </div>
    </div>
  );
}
