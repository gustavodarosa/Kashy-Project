function errorHandler(err, req, res, next) {
    console.error('Erro:', err.message);
    res.status(err.status || 500).json({
      error: true,
      message: err.message || 'Erro interno do servidor',
    });
  }
  
  module.exports = { errorHandler };