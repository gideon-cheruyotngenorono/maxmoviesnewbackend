const apiClient = require('../../utils/apiClient');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 405,
      success: false,
      message: 'Method not allowed. Use GET.'
    });
  }

  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'ID parameter is required'
      });
    }

    const data = await apiClient.get(`/info/${id}`);
    
    return res.status(200).json({
      status: 200,
      success: true,
      creator: "GiftedTech",
      ...data
    });
    
  } catch (error) {
    return res.status(error.status || 500).json({
      status: error.status || 500,
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};
