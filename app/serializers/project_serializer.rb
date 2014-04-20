class ProjectSerializer < ActiveModel::Serializer
	attributes :title, :description, :git, :link, :tag_list, :id, :image, :image_thumb, :image_medium

	def image_thumb
		object.image.url(:thumb)
	end

	def image_medium
		object.image.url(:medium)
	end

end