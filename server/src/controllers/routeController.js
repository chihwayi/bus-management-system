const { getDatabase } = require('../models/database');
const Route = require('../models/Route');

class RouteController {
  constructor() {
    this.dbManager = getDatabase(); 
    this.route = new Route(this.dbManager.db);
  }

  validateRouteData(data) {
    const errors = [];
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Route name is required and must be a non-empty string');
    }
    
    if (!data.boardingArea || typeof data.boardingArea !== 'string' || data.boardingArea.trim().length === 0) {
      errors.push('Boarding area is required and must be a non-empty string');
    }
    
    if (data.distanceKm !== undefined && (typeof data.distanceKm !== 'number' || data.distanceKm < 0)) {
      errors.push('Distance must be a positive number');
    }
    
    if (data.baseFare !== undefined && (typeof data.baseFare !== 'number' || data.baseFare < 0)) {
      errors.push('Base fare must be a positive number');
    }
    
    return errors;
  }

  async createRoute(req, res) {
    try {
      // Validate input data
      const validationErrors = this.validateRouteData(req.body);
      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: validationErrors 
        });
      }

      // Clean and prepare data
      const routeData = {
        name: req.body.name.trim(),
        boardingArea: req.body.boardingArea.trim(),
        distanceKm: req.body.distanceKm || 0,
        baseFare: req.body.baseFare || 0
      };

      const newRoute = this.route.create(routeData);
      res.status(201).json({ success: true, data: newRoute });
    } catch (error) {
      console.error('Route creation error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getRoute(req, res) {
    try {
      const route = this.route.getById(req.params.id);
      if (!route) {
        return res.status(404).json({ success: false, error: 'Route not found' });
      }
      res.json({ success: true, data: route });
    } catch (error) {
      console.error('Get route error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAllRoutes(req, res) {
    try {
      const routes = this.route.getAll();
      res.json({ success: true, data: routes });
    } catch (error) {
      console.error('Get all routes error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateRoute(req, res) {
    try {
      // Validate input data for update
      const validationErrors = this.validateRouteData(req.body);
      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: validationErrors 
        });
      }

      const updatedRoute = this.route.update(req.params.id, req.body);
      res.json({ success: true, data: updatedRoute });
    } catch (error) {
      console.error('Route update error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deleteRoute(req, res) {
    try {
      const result = this.route.delete(req.params.id);
      if (!result) {
        return res.status(404).json({ success: false, error: 'Route not found' });
      }
      res.json({ success: true, message: 'Route deleted successfully' });
    } catch (error) {
      console.error('Route deletion error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getRoutePassengers(req, res) {
    try {
      const passengers = this.route.getPassengers(req.params.id);
      res.json({ success: true, data: passengers });
    } catch (error) {
      console.error('Get route passengers error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getRouteConductors(req, res) {
    try {
      const conductors = this.route.getConductors(req.params.id);
      res.json({ success: true, data: conductors });
    } catch (error) {
      console.error('Get route conductors error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getRouteStats(req, res) {
    try {
      const stats = this.route.getStatistics(req.params.id);
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Get route stats error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

const routeController = new RouteController();

module.exports = {
  createRoute: routeController.createRoute.bind(routeController),
  getRoute: routeController.getRoute.bind(routeController),
  getAllRoutes: routeController.getAllRoutes.bind(routeController),
  updateRoute: routeController.updateRoute.bind(routeController),
  deleteRoute: routeController.deleteRoute.bind(routeController),
  getRoutePassengers: routeController.getRoutePassengers.bind(routeController),
  getRouteConductors: routeController.getRouteConductors.bind(routeController),
  getRouteStats: routeController.getRouteStats.bind(routeController)
};