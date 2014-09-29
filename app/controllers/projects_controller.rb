class ProjectsController < ApplicationController
	before_action :authenticate_user!, only: [:new, :create, :edit, :update, :destroy, :admin]
	before_action :admin_only!, except: [:index, :show, :featured]
	before_action :set_project, only: [:edit, :update, :destroy, :show]

	def index
		@projects = Project.active
		render json: @projects, root: false
	end

	def show
		render json: @project, root: false
	end

	def featured
		@project = Project.where(featured: true).first
		render json: @project, root: false
	end

	def admin
		@projects = Project.all
		@tags = Tag.all
	end

	def new
		@project = Project.new
	end

	def create
		@project = Project.new(project_params)
		if @project.save
			flash[:notice] = "Successfully created..."
			redirect_to admin_path
		else
			flash[:notice] = "uhoh"
		end
	end

	def edit
	end

	def update
		if @project.update(project_params)
			flash[:notice] = "Successfully updated..."
			redirect_to admin_path
		else
			flash[:notice] = "uhoh"
			redirect_to admin_path
		end
	end

	def destroy
		if @project.destroy
			flash[:notice] = "Successfully destroyed..."
			redirect_to admin_path
		else
			flash[:notice] = "uhoh"
			redirect_to admin_path
		end
	end

	private

	def set_project
		@project = Project.find(params[:id])
	end

	def project_params
		params.require(:project).permit(:title, :description, :git,
		:image, :active, :featured, :lede, :link, tag_ids: [])
	end

	def admin_only!
		if current_user.admin == false
			redirect_to root_path
		end
	end
end
