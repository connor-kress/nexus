function NodeSummaryPanel() {
  return (
    <div className="h-full w-full overflow-auto p-3">
      <div className="text-sm font-medium text-gray-600 mb-2">Node Summary</div>
      <div className="h-full rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <p className="text-sm text-gray-700">
          Select a node to see its summary…
        </p>
      </div>
    </div>
  );
}

export default NodeSummaryPanel;
